import type { Metadata } from 'next';
import { GradeSalaryPage, gradeMetadata } from '@/components/payscale/GradeSalaryPage';

// One static route per grade, so /grade-19-salary is a real URL rather than
// something the [vertical] catch-all has to be taught to ignore.
export const metadata: Metadata = gradeMetadata(19);

export default function Page() {
  return <GradeSalaryPage grade={19} />;
}
