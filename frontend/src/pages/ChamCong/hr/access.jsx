import { createContext, useContext } from 'react'

/* Ngữ cảnh phân quyền của phân hệ HR:
   role, user (nhân viên đang đăng nhập), can(module, action), inScope(emp), log(module, action, target) */
export const AccessContext = createContext(null)
export const useAccess = () => useContext(AccessContext)

/* Lọc dữ liệu theo phạm vi của vai trò: all | dept (phòng ban của người dùng) | self */
export function makeScope(scope, user) {
  return emp => scope === 'all' || (scope === 'dept' ? emp.dept === user.dept : emp.id === user.id)
}

/* Khối thông báo khi vai trò hiện tại không có quyền */
export function NoAccess({ text = 'Vai trò hiện tại không có quyền truy cập phân hệ này.' }) {
  return (
    <div className="cc-card cc-noaccess">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      <b>Không có quyền truy cập</b>
      <span>{text}</span>
    </div>
  )
}
