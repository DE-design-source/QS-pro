import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import './Chat.css'
import { ME, COLORS, CONVERSATIONS } from '../../data/chatData'
import ConversationList from './components/ConversationList'
import Thread from './components/Thread'
import InfoPanel from './components/InfoPanel'
import DirectoryModal from './components/DirectoryModal'
import Dezbot, { loadAiPanelWidth } from './components/Dezbot'
import { loadKdRequests, saveKdRequests } from '../../services/kdRequestService'

/* Sao chép dữ liệu mẫu để state của trang không sửa trực tiếp vào hằng số */
function cloneConversations() {
  /* Phiếu yêu cầu gửi từ trang Kinh doanh: thêm vào cuối hội thoại SiteFlow Bot */
  const requests = loadKdRequests()
  const requestMsgs = requests.map(r => ({
    bot: true, request: true, reqId: r.id, title: r.title, text: r.leadName,
    time: new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  }))
  const waiting = requests.filter(r => r.status !== 'approved' && r.status !== 'rejected').length
  return CONVERSATIONS.map(c => ({
    ...c,
    members: (c.members || []).map(m => ({ ...m })),
    messages: c.messages.map(m => ({ ...m })).concat(c.type === 'bot' ? requestMsgs : []),
    unread: c.type === 'bot' ? c.unread + waiting : c.unread,
  }))
}

export default function Chat() {
  const location = useLocation()
  const [conversations, setConversations] = useState(cloneConversations)
  const [requests, setRequests] = useState(loadKdRequests)
  /* Bản HTML: mở chat.html#<id> thì chọn sẵn hội thoại đó */
  const [activeId, setActiveId] = useState(() => {
    const hashId = (location.hash || '').replace('#', '')
    return hashId && CONVERSATIONS.some(c => c.id === hashId) ? hashId : 'g1'
  })
  const [filterTab, setFilterTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  /* Popover thêm thành viên đang mở: null | 'head' (đầu thread) | 'info' (cột thông tin) */
  const [memberPop, setMemberPop] = useState(null)
  const [dirOpen, setDirOpen] = useState(false)
  const [scrollTick, setScrollTick] = useState(0)

  const [aiOpen, setAiOpen] = useState(false)
  const [aiWidth, setAiWidth] = useState(loadAiPanelWidth)
  const [aiResizing, setAiResizing] = useState(false)

  const activeConv = conversations.find(c => c.id === activeId)

  /* Bấm ra ngoài thì đóng popover thêm thành viên */
  useEffect(() => {
    if (!memberPop) return undefined
    const close = () => setMemberPop(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [memberPop])

  /* Sửa danh sách tin nhắn của hội thoại đang mở */
  function updateActiveMessages(fn) {
    setConversations(prev => prev.map(c => (c.id === activeId ? { ...c, messages: fn(c.messages) } : c)))
  }

  /* Bấm một dòng trong danh sách: mở hội thoại + xoá số chưa đọc */
  function selectConv(id) {
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, unread: 0 } : c)))
    openConv(id)
  }

  /* Mở hội thoại từ "Nhóm chung" / danh bạ: bản HTML không xoá số chưa đọc */
  function openConv(id) {
    setActiveId(id)
    setEditingIdx(null)
    setMemberPop(null)
    setScrollTick(t => t + 1)
  }

  function togglePinConv(id) {
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, pinned: !c.pinned } : c)))
  }

  function sendMessage({ text, image, file }) {
    const msg = { who: ME, time: 'Vừa xong', text }
    if (image) msg.image = image
    if (file) msg.file = file
    updateActiveMessages(msgs => [...msgs, msg])
  }

  /* Cập nhật một phiếu yêu cầu (xác nhận / điều phối / duyệt) và lưu lại */
  function updateRequest(id, patch) {
    const next = requests.map(r => (r.id === id ? { ...r, ...patch } : r))
    setRequests(next)
    saveKdRequests(next)
  }

  function saveEdit(idx, val) {
    /* Nội dung rỗng thì giữ nguyên tin cũ, chỉ đóng ô sửa */
    if (val) updateActiveMessages(msgs => msgs.map((m, i) => (i === idx ? { ...m, text: val, edited: true } : m)))
    setEditingIdx(null)
  }

  function togglePinMsg(idx) {
    updateActiveMessages(msgs => msgs.map((m, i) => (i === idx ? { ...m, pinned: !m.pinned } : m)))
  }

  function unpinMsg(idx) {
    updateActiveMessages(msgs => msgs.map((m, i) => (i === idx ? { ...m, pinned: false } : m)))
  }

  function deleteMsg(idx) {
    if (!window.confirm('Xoá tin nhắn này?')) return
    updateActiveMessages(msgs => msgs.filter((_, i) => i !== idx))
    /* Giữ ô sửa (nếu đang mở) bám đúng tin nhắn sau khi danh sách dịch chỉ số */
    setEditingIdx(cur => (cur === null ? null : cur === idx ? null : cur > idx ? cur - 1 : cur))
  }

  function addMember(name, role) {
    const palette = Object.values(COLORS)
    setConversations(prev => prev.map(c => (
      c.id === activeId ? { ...c, members: [...c.members, { name, role, color: palette[c.members.length % palette.length] }] } : c
    )))
    setMemberPop(null)
  }

  const toggleMemberPop = which => setMemberPop(cur => (cur === which ? null : which))

  return (
    <div
      className={`ch-page${aiOpen ? ' ch-ai-open' : ''}${aiResizing ? ' ch-ai-resizing' : ''}`}
      style={{ '--ai-panel-width': `${aiWidth}px` }}
    >
      <div className="ch-chat-shell">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          filterTab={filterTab}
          searchTerm={searchTerm}
          onTab={setFilterTab}
          onSearch={setSearchTerm}
          onSelect={selectConv}
          onTogglePin={togglePinConv}
          onOpenDirectory={() => setDirOpen(true)}
        />

        <Thread
          conv={activeConv}
          requests={requests}
          onUpdateRequest={updateRequest}
          editingIdx={editingIdx}
          scrollTick={scrollTick}
          memberPopOpen={memberPop === 'head'}
          onToggleMemberPop={() => toggleMemberPop('head')}
          onCloseMemberPop={() => setMemberPop(null)}
          onAddMember={addMember}
          onStartEdit={setEditingIdx}
          onCancelEdit={() => setEditingIdx(null)}
          onSaveEdit={saveEdit}
          onTogglePinMsg={togglePinMsg}
          onUnpinMsg={unpinMsg}
          onDeleteMsg={deleteMsg}
          onSend={sendMessage}
        />

        <InfoPanel
          conv={activeConv}
          conversations={conversations}
          memberPopOpen={memberPop === 'info'}
          onToggleMemberPop={() => toggleMemberPop('info')}
          onCloseMemberPop={() => setMemberPop(null)}
          onAddMember={addMember}
          onOpenConv={openConv}
        />
      </div>

      {/* Modal danh bạ công ty */}
      {dirOpen && (
        <DirectoryModal
          conversations={conversations}
          onClose={() => setDirOpen(false)}
          onOpenDm={id => { setDirOpen(false); openConv(id) }}
        />
      )}

      <Dezbot
        open={aiOpen}
        onToggle={() => setAiOpen(v => !v)}
        onClose={() => setAiOpen(false)}
        onResize={setAiWidth}
        onResizingChange={setAiResizing}
      />
    </div>
  )
}
