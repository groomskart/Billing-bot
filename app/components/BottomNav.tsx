'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const path = usePathname();

  const tabs = [
    { href: '/', label: 'New Order', icon: '✂️' },
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={'bottom-nav-tab' + (path === tab.href ? ' active' : '')}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
