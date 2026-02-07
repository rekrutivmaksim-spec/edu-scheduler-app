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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createEvents, EventAttributes } from 'ics';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Lesson {
  id: number;
  subject: string;
  type: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  room?: string;
  teacher?: string;
  color?: string;
}

interface ScheduleExportProps {
  schedule: Lesson[];
}

const ScheduleExport = ({ schedule }: ScheduleExportProps) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [open, setOpen] = useState(false);

  const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.createElement('div');
      element.style.padding = '40px';
      element.style.backgroundColor = 'white';
      element.style.width = '800px';
      element.style.fontFamily = 'Arial, sans-serif';

      let html = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; font-size: 32px; margin-bottom: 10px;">📅 Расписание занятий</h1>
          <p style="color: #666; font-size: 14px;">Создано в Studyfay • ${format(new Date(), 'dd MMMM yyyy', { locale: ru })}</p>
        </div>
      `;

      for (let day = 1; day <= 6; day++) {
        const dayLessons = schedule.filter(l => l.day_of_week === day);
        if (dayLessons.length === 0) continue;

        html += `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #8b5cf6; font-size: 24px; margin-bottom: 15px; border-bottom: 3px solid #8b5cf6; padding-bottom: 5px;">
              ${dayNames[day - 1]}
            </h2>
        `;

        dayLessons.forEach(lesson => {
          html += `
            <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-left: 5px solid #8b5cf6; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <h3 style="font-size: 18px; font-weight: bold; color: #111; margin-bottom: 8px;">${lesson.subject}</h3>
                  <div style="color: #555; font-size: 14px; margin-bottom: 5px;">
                    🕐 ${lesson.start_time} - ${lesson.end_time}
                  </div>
                  ${lesson.room ? `<div style="color: #555; font-size: 14px; margin-bottom: 5px;">📍 ${lesson.room}</div>` : ''}
                  ${lesson.teacher ? `<div style="color: #555; font-size: 14px;">👤 ${lesson.teacher}</div>` : ''}
                </div>
                <div style="background: #8b5cf6; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                  ${lesson.type === 'lecture' ? 'Лекция' : lesson.type === 'practice' ? 'Практика' : 'Лаб'}
                </div>
              </div>
            </div>
          `;
        });

        html += `</div>`;
      }

      element.innerHTML = html;
      document.body.appendChild(element);

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(element);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('расписание-studyfay.pdf');

      toast({
        title: "PDF создан!",
        description: "Расписание успешно экспортировано",
      });
    } catch (error) {
      console.error('Export PDF error:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setOpen(false);
    }
  };

  const exportToPNG = async () => {
    setIsExporting(true);
    try {
      const element = document.createElement('div');
      element.style.padding = '40px';
      element.style.backgroundColor = 'white';
      element.style.width = '1200px';
      element.style.fontFamily = 'Arial, sans-serif';

      let html = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; font-size: 48px; margin-bottom: 10px;">📅 Моё расписание</h1>
          <p style="color: #666; font-size: 18px;">Studyfay • ${format(new Date(), 'dd MMMM yyyy', { locale: ru })}</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
      `;

      for (let day = 1; day <= 6; day++) {
        const dayLessons = schedule.filter(l => l.day_of_week === day);
        
        html += `
          <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 15px; padding: 20px; border: 2px solid #8b5cf6;">
            <h2 style="color: #8b5cf6; font-size: 24px; margin-bottom: 15px; text-align: center; font-weight: bold;">
              ${dayNames[day - 1]}
            </h2>
        `;

        if (dayLessons.length === 0) {
          html += `<p style="text-align: center; color: #999; font-size: 16px;">Нет занятий</p>`;
        } else {
          dayLessons.forEach(lesson => {
            html += `
              <div style="background: white; border-left: 4px solid #8b5cf6; padding: 12px; margin-bottom: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="font-size: 16px; font-weight: bold; color: #111; margin-bottom: 6px;">${lesson.subject}</div>
                <div style="color: #555; font-size: 13px; margin-bottom: 4px;">🕐 ${lesson.start_time} - ${lesson.end_time}</div>
                ${lesson.room ? `<div style="color: #555; font-size: 13px;">📍 ${lesson.room}</div>` : ''}
              </div>
            `;
          });
        }

        html += `</div>`;
      }

      html += `</div>`;
      element.innerHTML = html;
      document.body.appendChild(element);

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(element);

      const link = document.createElement('a');
      link.download = 'расписание-studyfay.png';
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: "Картинка создана!",
        description: "Расписание сохранено как изображение",
      });
    } catch (error) {
      console.error('Export PNG error:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать картинку",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setOpen(false);
    }
  };

  const exportToICal = () => {
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
        link.download = 'расписание-studyfay.ics';
        link.click();

        toast({
          title: "Календарь создан!",
          description: "Импортируй файл в Google Calendar или Apple Calendar",
        });
      });
    } catch (error) {
      console.error('Export iCal error:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать календарь",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
        >
          <Icon name="Download" size={16} className="sm:mr-2 sm:w-[18px] sm:h-[18px]" />
          <span className="hidden xs:inline ml-1.5">Экспорт</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Экспорт расписания</DialogTitle>
          <DialogDescription>
            Выберите формат для экспорта вашего расписания
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button
            onClick={exportToPDF}
            disabled={isExporting || schedule.length === 0}
            className="w-full justify-start bg-red-500 hover:bg-red-600"
          >
            <Icon name="FileText" size={20} className="mr-3" />
            <div className="text-left">
              <div className="font-semibold">PDF документ</div>
              <div className="text-xs opacity-90">Для печати и просмотра</div>
            </div>
          </Button>

          <Button
            onClick={exportToPNG}
            disabled={isExporting || schedule.length === 0}
            className="w-full justify-start bg-blue-500 hover:bg-blue-600"
          >
            <Icon name="Image" size={20} className="mr-3" />
            <div className="text-left">
              <div className="font-semibold">Картинка PNG</div>
              <div className="text-xs opacity-90">Для фона на телефоне</div>
            </div>
          </Button>

          <Button
            onClick={exportToICal}
            disabled={isExporting || schedule.length === 0}
            className="w-full justify-start bg-green-500 hover:bg-green-600"
          >
            <Icon name="Calendar" size={20} className="mr-3" />
            <div className="text-left">
              <div className="font-semibold">Календарь iCal</div>
              <div className="text-xs opacity-90">Для Google Calendar, Apple Calendar</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleExport;