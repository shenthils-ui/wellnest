import { useState } from 'react';
import { todayISO } from '../lib/date';
import DateNav from '../components/DateNav';
import DayEditor from '../components/DayEditor';
import InstallBanner from '../components/InstallBanner';

export default function Today() {
  const [date, setDate] = useState(todayISO());
  return (
    <div className="animate-fade-in">
      <InstallBanner />
      <DateNav date={date} onChange={setDate} />
      <DayEditor date={date} />
    </div>
  );
}
