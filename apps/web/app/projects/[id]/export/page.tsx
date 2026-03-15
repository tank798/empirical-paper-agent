import { ExportPanel } from "../../../../components/export-panel";

export default async function ExportPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExportPanel projectId={id} />;
}
