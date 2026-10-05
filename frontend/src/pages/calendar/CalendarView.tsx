import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, Tag, CheckSquare, Briefcase, User 
} from 'lucide-react';
import { calendarApi } from '../../api/services';
import { CalendarEvent } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';

export const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ day: number; events: CalendarEvent[] } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const startOfMonth = new Date(year, month, 1).toISOString().substring(0, 10);
      const endOfMonth = new Date(year, month + 1, 0).toISOString().substring(0, 10);

      const res = await calendarApi.getEvents({
        start_date: startOfMonth,
        end_date: endOfMonth,
      });

      setEvents(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [year, month]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayEvents(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayEvents(null);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-l-2 border-blue-600';
      case 'leave':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-l-2 border-amber-600';
      case 'task':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-l-2 border-emerald-600';
      case 'project':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border-l-2 border-purple-600';
      case 'holiday':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-l-2 border-rose-600';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border-l-2 border-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Calendar & Schedules"
        subtitle="Unified corporate timeline for project milestones, sprints, leaves, meetings, and holidays"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 min-w-[140px] text-center">
              {monthName} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Calendar Grid Container */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Day Header Row */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-center py-2.5 text-xs font-bold uppercase text-slate-500 tracking-wider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 dark:divide-slate-700">
          {/* Leading empty cells */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] bg-slate-50/50 dark:bg-slate-900/20 p-2 opacity-30" />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayEvents = events.filter((e) => {
              const eDate = e.date ? e.date.substring(0, 10) : '';
              return eDate === dateStr;
            });

            const isToday =
              new Date().toISOString().substring(0, 10) === dateStr;

            return (
              <div
                key={dayNum}
                onClick={() => setSelectedDayEvents({ day: dayNum, events: dayEvents })}
                className={`min-h-[110px] p-2 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors ${
                  isToday ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                      isToday
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {dayEvents.length > 2 && (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      +{dayEvents.length - 2} more
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((ev, idx) => (
                    <div
                      key={idx}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate ${getEventBadgeClass(
                        ev.type
                      )}`}
                      title={`${ev.title} (${ev.type})`}
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Drawer / Card */}
      {selectedDayEvents && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-500" />
              Schedule for {monthName} {selectedDayEvents.day}, {year}
            </h3>
            <button
              onClick={() => setSelectedDayEvents(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="space-y-3">
            {selectedDayEvents.events.length > 0 ? (
              selectedDayEvents.events.map((ev, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${getEventBadgeClass(ev.type)}`}>
                        {ev.type}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {ev.title}
                      </h4>
                    </div>
                    {ev.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {ev.description}
                      </p>
                    )}
                  </div>
                  {ev.time && (
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                      {ev.time}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-2">No scheduled events or deadlines for this day.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
