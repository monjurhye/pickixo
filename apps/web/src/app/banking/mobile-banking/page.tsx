import { SubMenuPage, subMenuMetadata } from '@/components/layout/SubMenuPage';

export const revalidate = 300;

export const generateMetadata = () => subMenuMetadata('banking', 'mobile-banking');

export default function Page() {
  return <SubMenuPage vertical="banking" slug="mobile-banking" />;
}
