import { File, Image, Video, Music, FileText, Archive, Code, Table, Presentation } from 'lucide-react';
import { getFileCategory } from '@/lib/utils';

const icons = {
  image:        { Icon: Image,        color: 'text-teal' },
  video:        { Icon: Video,        color: 'text-purple-400' },
  audio:        { Icon: Music,        color: 'text-pink-400' },
  pdf:          { Icon: FileText,     color: 'text-red-400' },
  archive:      { Icon: Archive,      color: 'text-yellow-400' },
  document:     { Icon: FileText,     color: 'text-blue-400' },
  spreadsheet:  { Icon: Table,        color: 'text-success' },
  presentation: { Icon: Presentation, color: 'text-orange-400' },
  code:         { Icon: Code,         color: 'text-accent' },
  file:         { Icon: File,         color: 'text-muted' },
};

export function FileTypeIcon({ mimeType, name, size = 16, className = '' }) {
  const category = getFileCategory(mimeType, name);
  const { Icon, color } = icons[category] || icons.file;
  return <Icon size={size} className={`${color} ${className}`} />;
}
