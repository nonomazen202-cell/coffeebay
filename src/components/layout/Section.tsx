import React from 'react';

interface SectionProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg' | 'xl' | 'none';
  as?: React.ElementType;
}

const spacingMap = {
  none: '',
  sm:   'py-8 sm:py-12',
  md:   'py-12 sm:py-16 md:py-20',
  lg:   'py-16 sm:py-24 md:py-32',
  xl:   'py-20 sm:py-32 md:py-40',
};

export function Section({
  children,
  id,
  className = '',
  spacing = 'md',
  as: Tag = 'section',
}: SectionProps) {
  return (
    <Tag id={id} className={`${spacingMap[spacing]} ${className}`}>
      {children}
    </Tag>
  );
}
