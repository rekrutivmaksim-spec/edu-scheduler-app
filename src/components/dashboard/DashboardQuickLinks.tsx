import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';

const DashboardQuickLinks = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg text-center cursor-pointer hover:shadow-xl transition-shadow" onClick={() => navigate('/pomodoro')}>
        <div className="text-2xl mb-1">{'🍅'}</div>
        <div className="text-xs font-medium text-gray-600">{'Помодоро'}</div>
      </Card>
      <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg text-center cursor-pointer hover:shadow-xl transition-shadow" onClick={() => navigate('/assistant')}>
        <div className="text-2xl mb-1">{'🤖'}</div>
        <div className="text-xs font-medium text-gray-600">{'ИИ-репетитор'}</div>
      </Card>
      <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg text-center cursor-pointer hover:shadow-xl transition-shadow" onClick={() => navigate('/materials')}>
        <div className="text-2xl mb-1">{'📚'}</div>
        <div className="text-xs font-medium text-gray-600">{'Материалы'}</div>
      </Card>
      <Card className="p-4 bg-white/90 backdrop-blur border-0 shadow-lg text-center cursor-pointer hover:shadow-xl transition-shadow" onClick={() => navigate('/referral')}>
        <div className="text-2xl mb-1">{'🤝'}</div>
        <div className="text-xs font-medium text-gray-600">{'Пригласить'}</div>
      </Card>
    </div>
  );
};

export default DashboardQuickLinks;
