export function workspaceInitials(name: string) {
  const parts = name.split(/[-_.\s]+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function workspaceHueFromName(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export function workspaceIconSrc(workspace: { iconUrl?: string; iconUpdatedAt?: string }) {
  if (!workspace.iconUrl) return null
  if (!workspace.iconUpdatedAt) return workspace.iconUrl
  return `${workspace.iconUrl}?v=${encodeURIComponent(workspace.iconUpdatedAt)}`
}
