package database

import (
	"context"
	"strconv"
	"sync"

	"github.com/jackc/pgx/v5"

	"qspro-backend/internal/shared/omap"
)

// Transaction (D-13): d.Tx(ctx, fn) mở 1 transaction và đặt nó vào ctx truyền cho fn. Mọi lời gọi
// Select / Insert / Update / Remove của CÙNG *DB nhận ctx đó (hoặc ctx con của nó) tự chạy trên transaction,
// không phải đổi chữ ký repository. Lọc công ty, dịch tên VN <-> EN, dạng lỗi giữ nguyên.
//
//   - fn trả nil  -> COMMIT, rồi chạy các việc đăng ký bằng AfterCommit (theo thứ tự).
//   - fn trả lỗi  -> ROLLBACK, trả đúng lỗi đó (không bọc).
//   - fn panic    -> ROLLBACK rồi panic lại.
//   - Tx lồng Tx  -> SAVEPOINT: lỗi ở Tx trong chỉ huỷ phần của nó; Tx ngoài quyết định cuối cùng.
//
// Mỗi lệnh trong transaction chạy dưới 1 savepoint riêng: lệnh hỏng chỉ huỷ chính nó, transaction vẫn dùng
// tiếp được. Nhờ vậy chỗ code đang cố ý nuốt lỗi database (ghi nhật ký, thử cột mới rồi lùi...) chạy y như
// khi không có transaction. Savepoint + lệnh + release gửi chung 1 gói (batch simple protocol) -> lệnh thành
// công không tốn thêm lượt mạng; lệnh hỏng tốn thêm 1 lượt "rollback to savepoint".
//
// Không gọi mạng (Lark / Storage) bên trong fn: dùng AfterCommit. Không chạy goroutine dùng ctx của fn
// (các lệnh xếp hàng trên 1 kết nối; goroutine sống quá fn nhận lỗi "tx is closed").
// Pool() trả pool thô: truy vấn qua nó KHÔNG nằm trong transaction.

type txKey struct{}

// txConn: phần dùng chung của mọi tầng Tx trên 1 kết nối.
type txConn struct {
	mu sync.Mutex // pgx.Tx không an toàn khi dùng song song
	sp int64      // đếm tên savepoint của từng lệnh
}

// txState: 1 tầng Tx (ngoài cùng = transaction thật, trong = savepoint).
type txState struct {
	db    *DB
	tx    pgx.Tx
	conn  *txConn
	root  context.Context // ctx gốc không có transaction - đưa cho việc AfterCommit
	after []func(context.Context)
	done  bool
}

func txOf(ctx context.Context, d *DB) *txState {
	st, _ := ctx.Value(txKey{}).(*txState)
	if st == nil || st.db != d {
		return nil
	}
	return st
}

// InTx: ctx đang nằm trong transaction (chưa kết thúc) của d không.
func (d *DB) InTx(ctx context.Context) bool {
	st := txOf(ctx, d)
	return st != nil && !st.done
}

// Tx chạy fn trong 1 transaction (lồng nhau -> savepoint). Xem chú thích đầu file.
func (d *DB) Tx(ctx context.Context, fn func(ctx context.Context) error) error {
	outer := txOf(ctx, d)
	if outer != nil && outer.done {
		return wrapPg("BEGIN", "tx", pgx.ErrTxClosed)
	}
	st := &txState{db: d}
	if outer != nil {
		st.conn, st.root = outer.conn, outer.root
		outer.conn.mu.Lock()
		tx, err := outer.tx.Begin(ctx)
		outer.conn.mu.Unlock()
		if err != nil {
			return wrapPg("BEGIN", "tx", err)
		}
		st.tx = tx
	} else {
		p, err := d.Pool()
		if err != nil {
			return err
		}
		tx, err := p.Begin(ctx)
		if err != nil {
			return wrapPg("BEGIN", "tx", err)
		}
		st.tx, st.conn = tx, &txConn{}
		st.root = context.WithValue(ctx, txKey{}, (*txState)(nil))
	}
	finished := false
	defer func() {
		if !finished { // fn panic (hoặc runtime.Goexit) -> huỷ rồi để panic chạy tiếp
			st.rollback(ctx)
		}
	}()
	if err := fn(context.WithValue(ctx, txKey{}, st)); err != nil {
		finished = true
		st.rollback(ctx)
		return err
	}
	finished = true
	st.conn.mu.Lock()
	// fn đã chạy xong trọn vẹn: commit kể cả khi request vừa bị huỷ (như khi chưa có transaction, dữ liệu đã ghi)
	cerr := st.tx.Commit(context.WithoutCancel(ctx))
	st.conn.mu.Unlock()
	st.done = true
	if cerr != nil {
		if outer == nil {
			_ = st.tx.Rollback(context.WithoutCancel(ctx))
		}
		st.after = nil
		return wrapPg("COMMIT", "tx", cerr)
	}
	if outer != nil { // savepoint đã release: việc sau commit chờ transaction ngoài
		outer.after = append(outer.after, st.after...)
		return nil
	}
	for _, f := range st.after {
		f(st.root)
	}
	return nil
}

func (st *txState) rollback(ctx context.Context) {
	st.conn.mu.Lock()
	_ = st.tx.Rollback(context.WithoutCancel(ctx))
	st.conn.mu.Unlock()
	st.done = true
	st.after = nil
}

// AfterCommit: chạy f SAU KHI transaction ngoài cùng commit thành công (bỏ đi nếu rollback).
// Ngoài transaction -> chạy f ngay. Dùng cho việc phụ cố ý nuốt lỗi: Lark, xoá file Storage, thông báo...
// f nhận ctx không còn transaction.
func (d *DB) AfterCommit(ctx context.Context, f func(ctx context.Context)) {
	st := txOf(ctx, d)
	if st == nil || st.done {
		f(ctx)
		return
	}
	st.after = append(st.after, f)
}

func spName(n int64) string { return "qs_st_" + strconv.FormatInt(n, 10) }

// query: 1 lệnh (trả 1 dòng JSON) trong transaction, dưới savepoint riêng.
func (st *txState) query(ctx context.Context, sql string, params []any) ([]*omap.Map, error) {
	st.conn.mu.Lock()
	defer st.conn.mu.Unlock()
	if st.done {
		return nil, pgx.ErrTxClosed
	}
	st.conn.sp++
	sp := spName(st.conn.sp)
	b := &pgx.Batch{}
	b.Queue("savepoint " + sp)
	b.Queue(sql, params...)
	b.Queue("release savepoint " + sp)
	br := st.tx.SendBatch(ctx, b)
	_, spErr := br.Exec()
	var j *string
	qErr := spErr
	if spErr == nil {
		qErr = br.QueryRow().Scan(&j)
		if qErr == nil {
			_, qErr = br.Exec()
		}
	}
	cErr := br.Close()
	if qErr == nil {
		qErr = cErr
	}
	if qErr != nil {
		if spErr == nil { // savepoint đã tạo -> huỷ phần của lệnh hỏng, transaction dùng tiếp được
			bg := context.WithoutCancel(ctx)
			if _, e := st.tx.Exec(bg, "rollback to savepoint "+sp); e == nil {
				_, _ = st.tx.Exec(bg, "release savepoint "+sp)
			}
		}
		return nil, qErr
	}
	return decodeJ(j)
}

// locked: bản runLocked trong transaction - khoá + lệnh ghi chạy dưới 1 savepoint (khoá dòng giữ tới hết transaction).
func (st *txState) locked(ctx context.Context, lockSQL string, lockParams []any, sql string, params []any) ([]*omap.Map, error) {
	st.conn.mu.Lock()
	defer st.conn.mu.Unlock()
	if st.done {
		return nil, pgx.ErrTxClosed
	}
	sub, err := st.tx.Begin(ctx)
	if err != nil {
		return nil, err
	}
	fail := func(err error) ([]*omap.Map, error) {
		_ = sub.Rollback(context.WithoutCancel(ctx))
		return nil, err
	}
	if _, err := sub.Exec(ctx, lockSQL, lockParams...); err != nil {
		return fail(err)
	}
	out, err := queryJ(ctx, sub, sql, params)
	if err != nil {
		return fail(err)
	}
	if err := sub.Commit(ctx); err != nil {
		return fail(err)
	}
	return out, nil
}
