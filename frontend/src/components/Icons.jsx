// Inline SVG icons (Feather/Lucide-style, MIT-spirit). No icon library, no
// network — just currentColor strokes that inherit text colour.
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const I = (props, children) => (
  <svg {...base} {...props}>
    {children}
  </svg>
);

export const HomeIcon = (p) => I(p, <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>);
export const CalendarIcon = (p) => I(p, <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>);
export const ChartIcon = (p) => I(p, <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>);
export const CogIcon = (p) => I(p, <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 9 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>);
export const CheckIcon = (p) => I(p, <path d="M20 6 9 17l-5-5" />);
export const MoonIcon = (p) => I(p, <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);
export const SunIcon = (p) => I(p, <><circle cx="12" cy="12" r="4.5" /><path d="M12 1.5v2M12 20.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1.5 12h2M20.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>);
export const DashIcon = (p) => I(p, <path d="M5 12h14" />);
export const PlusIcon = (p) => I(p, <path d="M12 5v14M5 12h14" />);
export const XIcon = (p) => I(p, <path d="M18 6 6 18M6 6l12 12" />);
export const ChevronLeft = (p) => I(p, <path d="M15 18l-6-6 6-6" />);
export const BookIcon = (p) => I(p, <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 0 4 20.5z" /><path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H20" /></>);
export const PhoneIcon = (p) => I(p, <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.1z" />);
export const MapPinIcon = (p) => I(p, <><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>);
export const LinkIcon = (p) => I(p, <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></>);
export const ChevronRight = (p) => I(p, <path d="M9 18l6-6-6-6" />);
export const PencilIcon = (p) => I(p, <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>);
export const TrashIcon = (p) => I(p, <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>);
export const GripIcon = (p) => I(p, <><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></>);
export const CloudIcon = (p) => I(p, <path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 19z" />);
export const CloudOffIcon = (p) => I(p, <><path d="M22.6 16.5A4.5 4.5 0 0 0 18 10h-.6a6 6 0 0 0-2.3-3.5M3 3l18 18" /><path d="M6.3 8.3A4 4 0 0 0 6.5 19h9.2" /></>);
export const RefreshIcon = (p) => I(p, <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5h-5" /></>);
export const DownloadIcon = (p) => I(p, <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>);
export const UploadIcon = (p) => I(p, <><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M5 3h14" /></>);
export const PrinterIcon = (p) => I(p, <><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></>);
export const BellIcon = (p) => I(p, <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>);
export const SparkleIcon = (p) => I(p, <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />);
export const HeartIcon = (p) => I({ ...p, fill: 'currentColor', stroke: 'none' }, <path d="M12 21s-7.5-5-9.5-9A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 9.5 6c-2 4-9.5 9-9.5 9z" />);
export const InfoIcon = (p) => I(p, <><circle cx="12" cy="12" r="9.5" /><path d="M12 16v-4M12 8h.01" /></>);
export const FlameIcon = (p) => I(p, <path d="M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-1.5.6-2.6 1.3-3.5C8 9 9 8 9 6.5c1.5 1 2 2.5 2 3.5 1-1 1-3 1-8z" />);
export const ListIcon = (p) => I(p, <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>);
