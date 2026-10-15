import { initialsOf } from '../../../data/lichData'

/* Avatar của một người: có person.avatar (đường dẫn ảnh) thì hiện ảnh, không thì hiện chữ viết tắt trên nền màu */
export default function Avatar({ person, className = 'lc-avatar', children, ...rest }) {
  return (
    <span className={className} style={{ background: person.color }} {...rest}>
      {person.avatar ? <img className="lc-avatar-img" src={person.avatar} alt={person.name} /> : initialsOf(person.name)}
      {children}
    </span>
  )
}
