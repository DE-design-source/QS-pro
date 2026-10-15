/* Phiên đăng nhập của riêng trang QS (không đụng phần còn lại của SiteFlow).
   useQsSession() -> {auth, loginMsg, me, congTy, viewAs, isAdmin, isSuper, canTab(tab), firstAllowedTab(),
                      login(user, pw), logout(), changePassword(oldPw, newPw), setViewAs(id|null), retry()}
   auth: 'init' | 'unconfigured' | 'checking' | 'login' | 'unreachable' | 'ready' (xem state/store.js). */
import {
  useQsStore, canTab, firstAllowedTab_, isAdminRole_, login, logout, changePassword, setViewAs, retrySession,
} from '../state/store'

export function useQsSession() {
  const auth = useQsStore(s => s.auth)
  const loginMsg = useQsStore(s => s.loginMsg)
  const me = useQsStore(s => s.me)
  const congTy = useQsStore(s => s.congTy)
  const viewAs = useQsStore(s => s.viewAs)
  return {
    auth, loginMsg, me, congTy, viewAs,
    isAdmin: isAdminRole_(me),
    isSuper: !!me && me.role === 'super',
    canTab: tab => canTab(tab, me, congTy),
    firstAllowedTab: () => firstAllowedTab_(me, congTy),
    login, logout, changePassword, setViewAs, retry: retrySession,
  }
}
