import type { Metadata } from 'next';
import { GradeSalaryPage, gradeMetadata } from '@/components/payscale/GradeSalaryPage';

// One static route per grade, so /grade-5-salary is a real URL rather than
// something the [vertical] catch-all has to be taught to ignore.
export const metadata: Metadata = gradeMetadata(5);

export default function Page() {
  return <GradeSalaryPage grade={5} />;
}
