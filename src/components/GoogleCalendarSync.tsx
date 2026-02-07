import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { createEvents, EventAttributes } from 'ics';

interface Lesson {
  id: number;
  subject: string;
  type: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  room?: string;
  teacher?: string;
}

interface GoogleCalendarSyncProps {
  schedule: Lesson[];
}

const GoogleCalendarSync = ({ schedule }: GoogleCalendarSyncProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportToGoogleCalendar = () => {
    setIsExporting(true);
    try {
      const events: EventAttributes[] = [];
      const now = new Date();
      const currentDay = now.getDay() || 7;
      
      schedule.forEach(lesson => {
        const daysUntilLesson = lesson.day_of_week - currentDay;
        const lessonDate = new Date(now);
        lessonDate.setDate(now.getDate() + daysUntilLesson);

        const [startHour, startMinute] = lesson.start_time.split(':').map(Number);
        const [endHour, endMinute] = lesson.end_time.split(':').map(Number);

        // Создаём события на 16 недель (семестр)
        for (let week = 0; week < 16; week++) {
          const eventDate = new Date(lessonDate);
          eventDate.setDate(lessonDate.getDate() + week * 7);

          const start: [number, number, number, number, number] = [
            eventDate.getFullYear(),
            eventDate.getMonth() + 1,
            eventDate.getDate(),
            startHour,
            startMinute,
          ];

          const end: [number, number, number, number, number] = [
            eventDate.getFullYear(),
            eventDate.getMonth() + 1,
            eventDate.getDate(),
            endHour,
            endMinute,
          ];

          events.push({
            start,
            end,
            title: lesson.subject,
            description: `Тип: ${lesson.type === 'lecture' ? 'Лекция' : lesson.type === 'practice' ? 'Практика' : 'Лабораторная'}\n${lesson.teacher ? `Преподаватель: ${lesson.teacher}` : ''}`,
            location: lesson.room || '',
            status: 'CONFIRMED',
            busyStatus: 'BUSY',
          });
        }
      });

      createEvents(events, (error, value) => {
        if (error) {
          console.error('iCal error:', error);
          toast({
            title: "Ошибка",
            description: "Не удалось создать календарь",
            variant: "destructive",
          });
          return;
        }

        const blob = new Blob([value], { type: 'text/calendar' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'studyfay-расписание.ics';
        link.click();

        toast({
          title: "Файл создан!",
          description: "Откройте файл .ics на телефоне или импортируйте в Google Calendar",
        });
        
        setOpen(false);
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось экспортировать расписание",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-2 border-green-300 text-green-700 hover:bg-green-50 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
        >
          <Icon name="Calendar" size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
          <span className="hidden xs:inline ml-1.5">Google</span>
          <span className="hidden sm:inline"> Calendar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Синхронизация с Google Calendar</DialogTitle>
          <DialogDescription>
            Экспортируйте расписание в календарь на телефоне
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Icon name="Info" size={16} />
              Как это работает:
            </h4>
            <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal">
              <li>Нажмите "Экспортировать"</li>
              <li>Скачается файл .ics</li>
              <li>Откройте его на телефоне</li>
              <li>Выберите Google Calendar</li>
              <li>Расписание появится в календаре! 📅</li>
            </ol>
          </div>

          <Button
            onClick={exportToGoogleCalendar}
            disabled={isExporting || schedule.length === 0}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            <Icon name="Download" size={20} className="mr-2" />
            {isExporting ? 'Создание файла...' : 'Экспортировать в календарь'}
          </Button>

          {schedule.length === 0 && (
            <p className="text-sm text-center text-gray-500">
              Добавьте занятия в расписание для экспорта
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoogleCalendarSync;