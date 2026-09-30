export const inputCls = 'w-full rounded border border-line bg-white px-3 py-2 text-sm';
export default function Field({ label, children }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>{children}</label>;
}
