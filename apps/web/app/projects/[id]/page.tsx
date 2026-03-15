import { ResearchWorkspace } from "../../../components/research-workspace";

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResearchWorkspace projectId={id} />;
}
