import { useState } from 'react';
import { todayISO } from '../lib/date';
import DateNav from '../components/DateNav';
import DayEditor from '../components/DayEditor';

export default function Today() {
  const [date, setDate] = useState(todayISO());
  return (
    <div className="animate-fade-in">
      <DateNav date={date} onChange={setDate} />
      <DayEditor date={date} />
    </div>
  );
}
