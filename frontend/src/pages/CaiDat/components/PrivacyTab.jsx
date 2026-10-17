import { useState } from 'react'
import { Section, Group, Check, Radios, useSettings } from './shared'

/* Tab "Quyền riêng tư" — ai tìm thấy, thêm liên hệ, nhắn tin cho mình; danh sách chặn */
export default function PrivacyTab() {
  const { s, update } = useSettings()
  const [name, setName] = useState('')
  const blocklist = s.blocklist || []

  function block(e) {
    e.preventDefault()
    const value = name.trim()
    if (!value || blocklist.includes(value)) return
    update({ blocklist: [...blocklist, value] })
    setName('')
  }

  return (
    <>
      <Section title="Tìm kiếm & kết bạn">
        <Group label="Cho phép người khác tìm tôi qua">
          <Check k="findByEmail" label="Địa chỉ email: tran.anh@siteflow.vn" />
          <Check k="findByPhone" label="Số điện thoại: 0909 111 222" />
        </Group>
        <Group label="Khi có người xem số điện thoại của tôi">
          <Check k="notifyPhoneView" label="Gửi thông báo cho tôi" />
        </Group>
        <Group label="Cho phép thêm tôi vào liên hệ bằng">
          <Check k="addByCard" label="Danh thiếp" />
          <Check k="addByQr" label="Mã QR và liên kết hồ sơ của tôi" />
        </Group>
        <Group label="Cho phép thêm tôi từ">
          <Check k="addFromChat" label="Chat" />
          <Check k="addFromEvent" label="Sự kiện trên Lịch" />
          <Check k="addFromWiki" label="Wiki" />
          <Check k="addFromProject" label="Dự án & nhiệm vụ" />
        </Group>
      </Section>

      <Section title="Tin nhắn & múi giờ">
        <Group label="Ai có thể nhắn tin trực tiếp cho tôi">
          <Radios k="dmFrom" options={[
            { value: 'contacts', label: 'Chỉ liên hệ', desc: 'Gồm thành viên trong công ty và liên hệ bên ngoài (nhà thầu phụ, nhà cung cấp, khách hàng).' },
            { value: 'everyone', label: 'Mọi người' },
          ]} />
        </Group>
        <Group label="Hiển thị múi giờ" desc="Thành viên ở múi giờ khác sẽ thấy múi giờ của bạn trong Chat khi ngoài giờ làm việc.">
          <Radios k="tzDisplay" options={[
            { value: 'show', label: 'Hiện múi giờ của tôi' },
            { value: 'hide', label: 'Ẩn múi giờ' },
          ]} />
        </Group>
      </Section>

      <Section title="Danh sách chặn" desc="Người bị chặn không thể nhắn tin trực tiếp hay cộng tác với bạn.">
        {blocklist.length === 0
          ? <div style={{ fontSize: 12.5, color: 'var(--text-muted)', paddingBottom: 10 }}>Bạn chưa chặn ai.</div>
          : blocklist.map(n => (
            <div key={n} className="cd-block-row">
              {n}
              <button className="cd-link" onClick={() => update({ blocklist: blocklist.filter(x => x !== n) })}>Bỏ chặn</button>
            </div>
          ))}
        <form onSubmit={block} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="cd-select" value={name} onChange={e => setName(e.target.value)} placeholder="Tên hoặc email người cần chặn" />
          <button type="submit" className="cd-sidebar-pos-btn">Chặn</button>
        </form>
      </Section>
    </>
  )
}
