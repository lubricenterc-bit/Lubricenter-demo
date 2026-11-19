import { staticIds } from "@/lib/demo/static-ids";
import View from "./view";

export function generateStaticParams() {
  return staticIds("service-history").map((id) => ({ id }));
}

export default function Page() {
  return <View />;
}
