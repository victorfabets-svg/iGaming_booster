import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div>
      <header>
        <nav>
          {/* Header placeholder */}
        </nav>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
};

export default Layout;