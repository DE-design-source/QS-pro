import { NOTIFY_CHANNELS } from '../../../data/caiDatData'
import { cardStyle, titleStyle, RowText, ToggleSwitch, Section, Group, Check, Choices, useSettings } from './shared'

const SOUNDS = [
  { label: 'Tin nhắn', freq: 660 },
  { label: 'Tin nhắn @Tôi', freq: 880 },
  { label: 'Tin khẩn', freq: 1040 },
  { label: 'Tin từ liên hệ gắn sao', freq: 520 },
]

/* Phát thử một tiếng "bíp" ngắn bằng Web Audio */
function playSound(freq) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => ctx.close()
  } catch { /* trình duyệt không hỗ trợ */ }
}

const small = { fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const strong = { fontSize: 12, fontWeight: 600 }

function BannerPreview({ detail }) {
  return (
    <>
      <div style={{ ...small, display: 'flex', justifyContent: 'space-between' }}><span>SiteFlow</span><span>10:26</span></div>
      {detail
        ? <div><div style={strong}>Nguyễn Đức Anh</div><div style={small}>Đã cập nhật tiến độ tầng 5 rồi nhé.</div></div>
        : <div style={strong}>Bạn có một tin nhắn mới.</div>}
    </>
  )
}

function Badge({ red, children }) {
  return (
    <span style={{ position: 'absolute', top: -4, right: -4, minWidth: red ? 9 : 15, height: red ? 9 : 15, borderRadius: 8, background: red ? 'var(--danger)' : 'var(--text-muted)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</span>
  )
}

function MutedPreview({ red }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-alt)', flex: 'none' }}>
        <Badge red={red}>{red ? null : 3}</Badge>
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={strong}>Dự án Riverside</div>
        <div style={small}>{red ? '[3 tin nhắn] ' : ''}Vy: Chào buổi sáng!</div>
      </div>
    </div>
  )
}

function NavPreview({ show }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <span style={{ position: 'relative', width: 26, height: 22, borderRadius: 6, background: 'var(--surface-alt)' }}>
        {show ? <Badge>3</Badge> : null}
      </span>
      <span style={small}>Chat</span>
    </div>
  )
}

/* Tab "Thông báo" */
export default function NotifyTab() {
  const { s } = useSettings()
  return (
    <>
      <Section title="Thông báo tin nhắn">
        <Check k="notifyMsg" label="Nhận thông báo tin nhắn">
          <Check k="notifyAll" label="Tất cả tin nhắn mới" />
          <Check k="notifyBuzz" label="Tin khẩn" forced={s.notifyAll} />
          <Check k="notifyMention" label="Tin nhắn @Tôi" forced={s.notifyAll} />
          <Check k="notifyMentionAll" label="Tin nhắn @Tất cả" forced={s.notifyAll} />
          <Check k="notifyDirect" label="Tin nhắn trực tiếp" forced={s.notifyAll} />
          <Check k="notifyStarred" label="Tin từ liên hệ gắn sao" forced={s.notifyAll} />
        </Check>
        <Group label="Chat đã tắt thông báo">
          <Check k="notifyMuted" label="Vẫn báo tin nhắn mới trong chat đã tắt thông báo">
            <Check k="notifyCollapsed" label="Kể cả trong nhóm chat đã thu gọn" />
          </Check>
          <Check k="notifyDnd" label="Tắt thông báo tin nhắn khi tôi đang họp" desc="Dựa theo sự kiện đang diễn ra trên Lịch." />
        </Group>
      </Section>

      <Section title="Âm thanh & banner">
        <Check k="notifySound" label="Âm thanh thông báo">
          <div className="cd-choice-grid" style={{ gap: 8, margin: '4px 0 8px' }}>
            {SOUNDS.map(snd => (
              <button key={snd.label} type="button" className="cd-sound-btn" title="Nghe thử" onClick={() => playSound(snd.freq)}>
                {snd.label}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
              </button>
            ))}
          </div>
        </Check>
        <Check k="notifyBanner" label="Hiện banner thông báo">
          <div style={{ margin: '4px 0 8px' }}>
            <Choices k="bannerDetail" options={[
              { value: 'show', label: 'Hiện nội dung tin nhắn', preview: <BannerPreview detail /> },
              { value: 'hide', label: 'Ẩn nội dung tin nhắn', preview: <BannerPreview /> },
            ]} />
          </div>
        </Check>
      </Section>

      <Section title="Chat đã tắt thông báo" desc="Cách đánh dấu tin chưa đọc của những cuộc trò chuyện bạn đã tắt thông báo.">
        <Group label="Trong danh sách hội thoại">
          <Choices k="mutedBadge" options={[
            { value: 'gray', label: 'Số màu xám', preview: <MutedPreview /> },
            { value: 'red', label: 'Chấm đỏ', preview: <MutedPreview red /> },
          ]} />
        </Group>
        <Group label="Trên thanh điều hướng">
          <Choices k="mutedNav" options={[
            { value: 'show', label: 'Hiển thị', preview: <NavPreview show /> },
            { value: 'hide', label: 'Ẩn', preview: <NavPreview /> },
          ]} />
        </Group>
      </Section>

      <div style={cardStyle}>
        <h3 style={titleStyle(14)}>Kênh thông báo</h3>
        {NOTIFY_CHANNELS.map(c => (
          <div key={c.title} className="cd-settings-row">
            <RowText title={c.title} desc={c.desc} />
            <ToggleSwitch defaultOn={c.on} />
          </div>
        ))}
      </div>
    </>
  )
}
