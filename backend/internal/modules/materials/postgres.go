package materials

import "qspro-backend/internal/platform/database"

// NewRepository: Repository trên platform/database. *database.DB đã có sẵn đúng bốn lệnh của supa.js
// (dịch tên bảng / cột, phạm vi công ty, dạng lỗi "DB <METHOD> <bảng> -> <status> {json}").
func NewRepository(db *database.DB) Repository { return db }
