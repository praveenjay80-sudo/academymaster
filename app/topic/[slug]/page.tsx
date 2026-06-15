import { redirect } from "next/navigation";

export default async function TopicIndex({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ label?: string }>;
}) {
  const { slug } = await params;
  const { label } = await searchParams;
  const labelParam = label ? `?label=${encodeURIComponent(label)}` : "";
  redirect(`/topic/${slug}/canon${labelParam}`);
}
