// Package platform: hạ tầng dùng chung (database, storage, redis, logger).
//
// File này chỉ giữ chỗ cho các thư viện mà module nghiệp vụ sẽ dùng, để go.mod / go.sum
// có sẵn và các module không phải sửa go.mod.
package platform

import (
	_ "github.com/xuri/excelize/v2"
	_ "golang.org/x/crypto/bcrypt"
	_ "golang.org/x/crypto/scrypt"
	_ "golang.org/x/text/collate"
	_ "golang.org/x/text/language"
	_ "golang.org/x/text/unicode/norm"
)
