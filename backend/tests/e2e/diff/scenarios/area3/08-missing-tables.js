'use strict';
/* [khoảng trống vùng 3 + B.low: nhánh "database chưa chạy migration"] Các nhánh chỉ tới được khi THIẾU BẢNG:
     sp_yeu_thich  (favorite_products)      store_supa.js 728, 781, 788
     sp_combo      (product_combos)         store_supa.js 573-574, 735, 812, 891
     de_xuat       (purchase_proposals)     store_supa.js 1250, 1288; auth.js 685
     cong_tac      (work_items)             store_supa.js 1354-1360, 1366-1369
     cong_tac_history (work_item_histories) store_supa.js 1404
     du_an_data    (project_data_entries)   store_supa.js 270, 1111, 1146-1150
   Cách làm: ĐỔI TÊN bảng ở cả 2 database (giữ nguyên dữ liệu, khoá, sequence), gọi API, rồi đổi tên lại (try / finally).
   Danh mục bảng của server (supa.js catalog_, Go: platform/database/catalog.go) chỉ nạp lại khi lần nạp trước cách hơn 3 giây, nên câu lỗi
   phụ thuộc thời điểm: lời gọi ĐẦU sau khi mất bảng gặp lỗi của Postgres (42P01), các lời gọi sau gặp lỗi của danh mục (PGRST205).
   Để 2 server luôn ở cùng một trạng thái: chờ 3,3 giây sau khi đổi tên, sau lời gọi đầu, và sau khi đổi tên lại.
   Không thử ở đây (ghi trong báo cáo): thiếu CỘT của sản phẩm (nguoi_tao, nhom_bt, da_duyet...) vì bảng products được đọc qua view
   product_catalog - bỏ / đổi tên cột của bảng lõi không làm view mất cột; và thiếu cột của users / companies (ui_prefs, phong_ban, perms,
   dung_sp_dezon) vì mọi request đều đọc 2 bảng này để kiểm phiên. */
const { fx } = require('./_fx');
const CHO = 3300;

module.exports = {
  name: 'area3/08 thiếu bảng (database chưa chạy migration)',
  async run(h) {
    const f = await fx(h), S = f.S;
    const NOID = '00000000-0000-4000-8000-00000000dead';
    const mk = async (n) => f.idOf(await h.rpc(S.adminA, 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'DM sản phẩm ' + n, 'MÃ SẢN PHẨM': 'DM-' + n, 'GIÁ BÁN LẺ': 1000 }], { label: 'tạo SP DM-' + n }));
    const P1 = await mk(1), P2 = await mk(2);
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DM-DA', ten: 'Dự án thử thiếu bảng' }]);
    const tat = async (t) => { await h.sql('alter table public."' + t + '" rename to "' + t + '__tat"'); h.out('  -- đã đổi tên bảng ' + t + ' (coi như chưa có bảng)'); await h.sleep(CHO); };
    const bat = async (t) => { await h.sql('alter table if exists public."' + t + '__tat" rename to "' + t + '"'); h.out('  -- đã trả tên bảng ' + t); await h.sleep(CHO); };
    /* dau: lời gọi đầu tiên sau khi mất bảng (chỉ rpc: danh mục còn cũ -> lỗi 42P01 của Postgres); sau: các lời gọi tiếp theo (danh mục đã nạp lại);
       lai: lời gọi sau khi bảng có lại (phải chạy bình thường). */
    const thu = async (bang, dau, sau, lai) => {
      try {
        await tat(bang);
        await dau();
        await h.sleep(CHO);
        await sau();
      } finally { await bat(bang); }
      await lai();
    };

    /* ================= sp_yeu_thich ================= */
    await thu('favorite_products',
      () => h.rpc(S.adminA, 'setYeuThich', [[P1], true], { label: 'setYeuThich khi thiếu bảng sp_yeu_thich (lời gọi đầu)' }),
      async () => {
        await h.both(S.adminA, 'setYeuThich', [[P1, 'DM-2', 'KHÔNG-CÓ'], true], { label: 'setYeuThich bật khi thiếu bảng (lỗi từng khoá, store_supa.js:781)' });
        await h.both(S.adminA, 'setYeuThich', [[P1], false], { label: 'setYeuThich tắt khi thiếu bảng (store_supa.js:788)' });
        await h.both(S.root, 'setYeuThich', [[P1], true], { label: 'setYeuThich @super khi thiếu bảng' });
        await h.both(S.adminA, 'getProducts', [], { label: 'getProducts khi thiếu bảng sp_yeu_thich (bỏ qua dấu yêu thích, store_supa.js:728)' });
        await h.both(S.adminA, 'bootstrap', [], { label: 'bootstrap khi thiếu bảng sp_yeu_thich' });
        const tam = await mk('YT');
        await h.rpc(S.adminA, 'deleteDbProduct', [tam], { label: 'deleteDbProduct khi thiếu bảng sp_yeu_thich (dọn liên kết: nuốt lỗi)' });
      },
      async () => {
        await h.both(S.adminA, 'setYeuThich', [[P1], true], { label: 'setYeuThich sau khi bảng có lại' });
        await h.both(S.adminA, 'getProducts', [], { label: 'getProducts sau khi bảng sp_yeu_thich có lại' });
        await h.rpc(S.adminA, 'setYeuThich', [[P1], false]);
      });

    /* ================= sp_combo ================= */
    await thu('product_combos',
      () => h.rpc(S.adminA, 'getCombo', [P1], { label: 'getCombo khi thiếu bảng sp_combo (lời gọi đầu -> [])' }),
      async () => {
        await h.both(S.adminA, 'getCombo', [P1], { label: 'getCombo khi thiếu bảng sp_combo (store_supa.js:812 -> [])' });
        await h.both(S.adminA, 'setCombo', [P1, [{ id: P2, soLuong: 2 }]], { label: 'setCombo khi thiếu bảng sp_combo (store_supa.js:891)' });
        await h.both(S.adminA, 'setCombo', [P1, []], { label: 'setCombo [] khi thiếu bảng sp_combo' });
        await h.both(S.adminA, 'getProducts', [], { label: 'getProducts khi thiếu bảng sp_combo (không đếm combo, store_supa.js:735)' });
        const tam = await mk('CB');
        await h.rpc(S.adminA, 'deleteDbProduct', [tam], { label: 'deleteDbProduct khi thiếu bảng sp_combo (store_supa.js:573-574: nuốt lỗi)' });
      },
      async () => {
        await h.rpc(S.adminA, 'setCombo', [P1, [{ id: P2, soLuong: 2 }]], { label: 'setCombo sau khi bảng có lại' });
        await h.both(S.adminA, 'getCombo', [P1], { label: 'getCombo sau khi bảng sp_combo có lại' });
        await h.rpc(S.adminA, 'setCombo', [P1, []]);
      });

    /* ================= de_xuat ================= */
    const ck = { loai: 'ck', maDA: 'DM-DA', project: 'Dự án thử thiếu bảng', supplier: 'NCC thử', vatPct: 10, nguoiGui: 'Người thử', items: [{ ma: 'SP-1', ten: 'Đèn', dvt: 'Bộ', sl: 2, donGia: 90000, donGiaGoc: 100000, giamGiaPct: 10 }] };
    h.fake.take();
    await thu('purchase_proposals',
      () => h.rpc(S.adminA, 'listDeXuat', [], { label: 'listDeXuat khi thiếu bảng de_xuat (lời gọi đầu -> [])' }),
      async () => {
        for (const a of [[], ['ck'], ['tt']]) await h.both(S.adminA, 'listDeXuat', a, { label: 'listDeXuat ' + JSON.stringify(a) + ' khi thiếu bảng de_xuat (auth.js:685 -> [])' });
        await h.both(S.edit, 'getDeXuatList', ['DM-DA'], { label: 'getDeXuatList khi thiếu bảng de_xuat (store_supa.js:1288 -> [])' });
        await h.both(S.edit, 'sendDeXuat', [ck], { label: 'sendDeXuat chiết khấu khi thiếu bảng de_xuat (store_supa.js:1250)' });
        await h.both(S.edit, 'sendDeXuat', [Object.assign({}, ck, { loai: 'tt', dots: [{ dot: 1, pct: 100, tien: 5 }] })], { label: 'sendDeXuat thanh toán khi thiếu bảng de_xuat' });
        await h.both(S.adminA, 'getDeXuat', ['CK-KHONG-CO'], { label: 'getDeXuat khi thiếu bảng de_xuat (lỗi của tầng database)' });
        await h.both(S.adminA, 'resolveDeXuat', ['CK-KHONG-CO', true], { label: 'resolveDeXuat khi thiếu bảng de_xuat' });
        h.fakeCheck('thiếu bảng de_xuat: không gửi thẻ Lark nào', { count: 0 });
      },
      async () => {
        await h.both(S.adminA, 'listDeXuat', [], { label: 'listDeXuat sau khi bảng de_xuat có lại' });
        await h.both(S.edit, 'getDeXuatList', ['DM-DA'], { label: 'getDeXuatList sau khi bảng de_xuat có lại' });
      });

    /* ================= cong_tac ================= */
    await thu('work_items',
      () => h.rpc(S.adminA, 'ctList', [], { label: 'ctList khi thiếu bảng cong_tac (lời gọi đầu -> [])' }),
      async () => {
        await h.both(S.adminA, 'ctList', [], { label: 'ctList khi thiếu bảng cong_tac (store_supa.js:1366-1369 -> [])' });
        await h.both(S.adminA, 'ctSave', [{ ten: 'Công tác không lưu được', loai: 'kt_sobo' }], { label: 'ctSave khi thiếu bảng cong_tac (store_supa.js:1354-1360)' });
        await h.both(S.adminA, 'ctUpdate', [NOID, { gc: 'x' }], { label: 'ctUpdate khi thiếu bảng cong_tac' });
        await h.both(S.adminA, 'ctDelete', [[NOID]], { label: 'ctDelete khi thiếu bảng cong_tac' });
        await h.both(S.adminA, 'ctDuyet', [[NOID], true], { label: 'ctDuyet khi thiếu bảng cong_tac' });
        await h.both(S.adminA, 'ctFav', [[NOID], true], { label: 'ctFav khi thiếu bảng cong_tac' });
      },
      () => h.both(S.adminA, 'ctList', [], { label: 'ctList sau khi bảng cong_tac có lại' }));

    /* ================= cong_tac_history ================= */
    let ctId = null;
    await thu('work_item_histories',
      () => h.rpc(S.adminA, 'ctHistory', [NOID], { label: 'ctHistory khi thiếu bảng cong_tac_history (lời gọi đầu)' }),
      async () => {
        await h.both(S.adminA, 'ctHistory', [NOID], { label: 'ctHistory khi thiếu bảng cong_tac_history (store_supa.js:1404)' });
        const r = await h.rpc(S.adminA, 'ctSave', [{ ten: 'DM công tác khi thiếu bảng lịch sử', loai: 'kt_sobo', dg: 1000 }], { label: 'ctSave khi thiếu bảng cong_tac_history (vẫn lưu, bỏ lịch sử)' });
        const a = r.node.json && r.node.json.result && r.node.json.result.rows, b = r.go.json && r.go.json.result && r.go.json.result.rows;
        if (a && a[0] && b && b[0]) {
          ctId = h.pair(a[0].id, b[0].id);
          await h.rpc(S.adminA, 'ctUpdate', [ctId, { gc: 'sửa khi thiếu bảng lịch sử' }], { label: 'ctUpdate khi thiếu bảng cong_tac_history' });
          await h.rpc(S.adminA, 'ctDuyet', [[ctId], true], { label: 'ctDuyet khi thiếu bảng cong_tac_history' });
          await h.both(S.adminA, 'ctHistory', [ctId], { label: 'ctHistory của công tác vừa tạo khi thiếu bảng lịch sử' });
        }
      },
      async () => {
        if (ctId) { await h.both(S.adminA, 'ctHistory', [ctId], { label: 'ctHistory sau khi bảng có lại (không có lịch sử của lúc thiếu bảng)' }); await h.rpc(S.adminA, 'ctDelete', [[ctId]], { label: 'dọn công tác DM' }); }
      });

    /* ================= du_an_data ================= */
    await thu('project_data_entries',
      () => h.rpc(S.adminA, 'getProjData', ['DM-DA'], { label: 'getProjData khi thiếu bảng du_an_data (lời gọi đầu)' }),
      async () => {
        await h.both(S.adminA, 'getProjData', ['DM-DA'], { label: 'getProjData khi thiếu bảng du_an_data (store_supa.js:1111)' });
        await h.both(S.adminA, 'setProjData', ['DM-DA', 'ghiChu', { a: 1 }], { label: 'setProjData khi thiếu bảng du_an_data (store_supa.js:1146-1150)' });
        await h.both(S.adminA, 'bootstrap', ['DM-DA'], { label: 'bootstrap khi thiếu bảng du_an_data' });
        await h.rpc(S.adminA, 'createProject', [{ maDA: 'DM-DA2', ten: 'Dự án xoá khi thiếu bảng' }]);
        await h.rpc(S.adminA, 'deleteProject', ['DM-DA2'], { label: 'deleteProject khi thiếu bảng du_an_data (store_supa.js:270: nuốt lỗi)' });
      },
      async () => {
        await h.rpc(S.adminA, 'setProjData', ['DM-DA', 'ghiChu', { a: 1 }], { label: 'setProjData sau khi bảng du_an_data có lại' });
        await h.both(S.adminA, 'getProjData', ['DM-DA'], { label: 'getProjData sau khi bảng du_an_data có lại' });
      });

    /* ================= dọn ================= */
    await h.rpc(S.adminA, 'deleteProject', ['DM-DA']);
    for (const p of [P1, P2]) await h.rpc(S.adminA, 'deleteDbProduct', [p], { label: 'dọn SP DM' });
    await h.both(S.adminA, 'getProducts', [], { label: 'getProducts cuối kịch bản thiếu bảng' });
  },
};
