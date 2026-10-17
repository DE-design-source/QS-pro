import { Fragment } from 'react'
import { SETTINGS_DEFAULTS, SHORTCUTS } from '../../../data/caiDatData'
import { Section, Group, Select, RowText, useSettings } from './shared'

/* Tab "Phím tắt" — phím gửi tin nhắn & danh sách phím tắt */
export default function ShortcutsTab() {
  const { update } = useSettings()
  return (
    <>
      <Section title="Phím tắt">
        <Group label="Gửi tin nhắn bằng">
          <Select k="sendKey" options={[['enter', 'Enter'], ['ctrl-enter', 'Ctrl + Enter']]} hint="Phím còn lại dùng để xuống dòng." />
        </Group>
        <div className="cd-settings-row" style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingBottom: 0 }}>
          <RowText title="Khôi phục mặc định" desc="Đưa toàn bộ phím tắt về thiết lập ban đầu" />
          <button className="cd-sidebar-pos-btn" onClick={() => update({ sendKey: SETTINGS_DEFAULTS.sendKey })}>Khôi phục</button>
        </div>
      </Section>

      <Section title="Danh sách phím tắt">
        {SHORTCUTS.map(sc => (
          <div key={sc.label} className="cd-shortcut-row">
            <span>{sc.label}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
              {sc.keys.map((key, i) => (
                <Fragment key={key}>
                  {i > 0 ? <span style={{ color: 'var(--text-muted)' }}>+</span> : null}
                  <span className="cd-kbd">{key}</span>
                </Fragment>
              ))}
            </span>
          </div>
        ))}
      </Section>
    </>
  )
}
