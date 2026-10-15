package projects

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: mỗi phương thức là MỘT lệnh supa.* của store_supa.js (số dòng ghi kèm), trả dòng thô của database.
// Tham số mã dự án để kiểu any vì Node đưa thẳng giá trị client vào supa.eq (undefined -> "undefined").
type Repository interface {
	ListProjects(ctx context.Context) ([]*omap.Map, error)                                       // S:233
	FindProject(ctx context.Context, maDA any) ([]*omap.Map, error)                              // S:237, 279
	InsertProject(ctx context.Context, row *omap.Map) ([]*omap.Map, error)                       // S:253, 285
	UpdateProject(ctx context.Context, maDA any, patch *omap.Map) ([]*omap.Map, error)           // S:262
	DeleteProject(ctx context.Context, maDA any) error                                           // S:271
	DeleteLines(ctx context.Context, maDA any) error                                             // S:267
	DeleteCover(ctx context.Context, maDA any) error                                             // S:268
	DeleteProjData(ctx context.Context, maDA any) error                                          // S:270
	ListLinesRaw(ctx context.Context, maDA any) ([]*omap.Map, error)                             // S:289
	InsertLines(ctx context.Context, rows []*omap.Map) error                                     // S:292
	ListCoverRaw(ctx context.Context, maDA any) ([]*omap.Map, error)                             // S:297
	InsertCover(ctx context.Context, rows []*omap.Map) error                                     // S:300
	ListProjDataRaw(ctx context.Context, maDA any) ([]*omap.Map, error)                          // S:306
	InsertProjDataRows(ctx context.Context, rows []*omap.Map) error                              // S:309
	ListProjDataKV(ctx context.Context, maDA string) ([]*omap.Map, error)                        // S:1110
	ListCompanySettings(ctx context.Context, khongCongTy bool) ([]*omap.Map, error)              // S:1115-1116
	FindCompanySetting(ctx context.Context, loc string, khongCongTy bool) ([]*omap.Map, error)   // S:1134
	UpdateCompanySetting(ctx context.Context, loc string, row *omap.Map, khongCongTy bool) error // S:1135
	InsertCompanySetting(ctx context.Context, row *omap.Map, khongCongTy bool) error             // S:1136
	FindProjData(ctx context.Context, maDA, khoa string) ([]*omap.Map, error)                    // S:1143
	UpdateProjData(ctx context.Context, maDA, khoa string, row *omap.Map) error                  // S:1144
	InsertProjData(ctx context.Context, row *omap.Map) error                                     // S:1145
}
