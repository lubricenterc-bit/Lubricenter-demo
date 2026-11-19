import { PROJECTS } from "@/lib/demo/guide/projects";
import { PrototypeView } from "./prototype-view";

export function generateStaticParams() {
  return PROJECTS.map(p => ({ slug: p.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = PROJECTS.find(p => p.slug === slug)!;
  return <PrototypeView project={project} />;
}
