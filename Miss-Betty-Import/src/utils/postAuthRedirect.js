const KEY = "mbimport_post_auth_redirect";

export function setPostAuthRedirect(path) {
  sessionStorage.setItem(KEY, path);
}

export function consumePostAuthRedirect() {
  const value = sessionStorage.getItem(KEY);
  if (value) sessionStorage.removeItem(KEY);
  return value;
}
