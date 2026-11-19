import { staticIds } from "@/lib/demo/static-ids";
import View from "./view";

export function generateStaticParams() {
  return staticIds("purchases").map((id) => ({ id }));
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <View params={props.params} />;
}
