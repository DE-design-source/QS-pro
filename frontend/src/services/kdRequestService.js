import { storage } from './storageService'

/* Phiếu yêu cầu từ trang Kinh doanh gửi sang Chat (SiteFlow Bot).
   Lưu localStorage vì hai trang không dùng chung state.

   Luồng trạng thái:
   pending  → (Đồng ý) dispatch | (Từ chối + lý do) rejected
   dispatch → (chọn quản lý / nhân viên) assigned
   assigned → (người được giao gửi yêu cầu duyệt) review | (Từ chối + lý do) rejected
   review   → (Quản lý duyệt) approved | (Không duyệt + lý do) rejected */

const KEY = 'kd-requests'

export function loadKdRequests() {
  const list = storage.get(KEY, [])
  return Array.isArray(list) ? list : []
}

export function saveKdRequests(list) {
  storage.set(KEY, list)
}

export function addKdRequest(data) {
  const now = new Date().toISOString()
  const req = {
    ...data,
    id: 'rq' + Date.now(),
    createdAt: now,
    status: 'pending',
    assignee: null,
    rejectReason: '',
    history: [{ at: now, text: `${data.sender} gửi phiếu đến Phòng ${data.dept}` }],
  }
  saveKdRequests([...loadKdRequests(), req])
  return req
}
