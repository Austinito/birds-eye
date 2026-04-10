import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { title?: string }

function makeIcon(
  Path: (props: { title?: string }) => JSX.Element,
  viewBox: string = '0 0 24 24',
) {
  return function Icon({ title, ...props }: IconProps) {
    const ariaProps = title
      ? { role: 'img', 'aria-label': title }
      : { 'aria-hidden': true as const }

    return (
      <svg
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        {...ariaProps}
        {...props}
      >
        {title ? <title>{title}</title> : null}
        <Path title={title} />
      </svg>
    )
  }
}

function UserPath() {
  return (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20a6 6 0 0 1 12 0Z" />
    </>
  )
}

function AgentPath() {
  return (
    <>
      <rect x="6" y="7" width="12" height="10" rx="2" ry="2" />
      <circle cx="10" cy="12" r="1.4" />
      <circle cx="14" cy="12" r="1.4" />
      <path d="M9 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 5V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1" />
    </>
  )
}

function SystemPath() {
  return (
    <>
      <path d="M8 4h7l3 3v13H6V4h2Z" />
      <path d="M15 4v3h3" />
      <path d="M9 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  )
}

function ToolOkPath() {
  return (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.4 12.6 11 15.2 16 9.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  )
}

function ToolErrPath() {
  return (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.2 9.2 14.8 14.8M14.8 9.2 9.2 14.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  )
}

function TokenInPath() {
  return (
    <>
      <rect x="11" y="5" width="8" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M9 9l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  )
}

function TokenOutPath() {
  return (
    <>
      <rect x="5" y="5" width="8" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M15 9l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  )
}

function CacheReadPath() {
  return (
    <>
      <path
        d="M18 8c0 1.7-2.7 3-6 3S6 9.7 6 8s2.7-3 6-3 6 1.3 6 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6 8v8c0 1.7 2.7 3 6 3s6-1.3 6-3V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M9.7 14.8 12 16.9l2.3-2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  )
}

function CacheWritePath() {
  return (
    <>
      <path
        d="M18 8c0 1.7-2.7 3-6 3S6 9.7 6 8s2.7-3 6-3 6 1.3 6 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6 8v8c0 1.7 2.7 3 6 3s6-1.3 6-3V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 16v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M9.7 12.2 12 10.1l2.3 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  )
}

function ArchivePath() {
  return (
    <>
      <path
        d="M7 4h10l2 3H5l2-3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <rect x="5" y="7" width="14" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M9.5 13.5 12 16l2.5-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  )
}

function DonePath() {
  return (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.4 12.6 11 15.2 16 9.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  )
}

function SpinnerPath() {
  return (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.25" />
      <path
        d="M20 12a8 8 0 0 0-8-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  )
}

function BrainPath() {
  return (
    <>
      <path
        d="M8.6 8.2C7.2 6 8.8 3.5 11.2 3.5c1.1 0 2.1.5 2.8 1.3.7-.8 1.7-1.3 2.8-1.3 2.4 0 4 2.5 2.6 4.7 1.6.6 2.6 2.2 2.2 4-.3 1.4-1.4 2.4-2.7 2.6-.3 2-2 3.6-4 3.6-1.2 0-2.3-.5-3.1-1.3-.8.8-1.9 1.3-3.1 1.3-2 0-3.7-1.6-4-3.6-1.3-.2-2.4-1.2-2.7-2.6-.4-1.8.6-3.4 2.2-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10.1 7.6c-1 .9-1 2.1 0 3.1s1 2.2 0 3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.9 7.6c1 .9 1 2.1 0 3.1s-1 2.2 0 3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  )
}

function SunPath() {
  return (
    <>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 19v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.2 4.2l2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.7 17.7l2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.8 4.2l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.3 17.7l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  )
}

function MoonPath() {
  // Thicker crescent than the default outline.
  return (
    <>
      <path
        d="M12 3a7.5 7.5 0 1 0 9 9 9 9 0 1 1-9-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )
}

function GearPath() {
  // Lucide-style settings/cog icon; centered on 12,12.
  return (
    <>
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  )
}

function ArrowRightPath() {
  return (
    <>
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M14 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  )
}

function ImagePath() {
  return (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 14l2.2-2.3a1.6 1.6 0 0 1 2.3 0L17 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
    </>
  )
}

function XPath() {
  return (
    <>
      <path d="M7 7l10 10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17 7 7 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>
  )
}

export const UserIcon = makeIcon(UserPath)
export const AgentIcon = makeIcon(AgentPath)
export const SystemIcon = makeIcon(SystemPath)
export const ToolOkIcon = makeIcon(ToolOkPath)
export const ToolErrIcon = makeIcon(ToolErrPath)
export const TokenInIcon = makeIcon(TokenInPath)
export const TokenOutIcon = makeIcon(TokenOutPath)
export const CacheReadIcon = makeIcon(CacheReadPath)
export const CacheWriteIcon = makeIcon(CacheWritePath)
export const ArchiveIcon = makeIcon(ArchivePath)
export const DoneIcon = makeIcon(DonePath)
export const SpinnerIcon = makeIcon(SpinnerPath)
export const BrainIcon = makeIcon(BrainPath)
export const SunIcon = makeIcon(SunPath)
export const MoonIcon = makeIcon(MoonPath)
export const GearIcon = makeIcon(GearPath)
export const ArrowRightIcon = makeIcon(ArrowRightPath)
export const ImageIcon = makeIcon(ImagePath)
export const XIcon = makeIcon(XPath)
