import React from 'react';
import { CustomGoogleMapModal } from '../maps/CustomGoogleMapModal';
import { useApp } from '../../context/AppContext';

interface NavigationTabProps {
  onNavigateHome?: () => void;
}

export const NavigationTab: React.FC<NavigationTabProps> = ({ onNavigateHome }) => {
  const { user } = useApp();

  return (
    <div className="w-full flex-1 flex flex-col min-h-screen">
      <CustomGoogleMapModal
        isOpen={true}
        onClose={onNavigateHome || (() => {})}
        userEmail={user?.email}
        isInlineTab={true}
      />
    </div>
  );
};

export default NavigationTab;

