import Link from "next/link";

export default function Page() {
  return (
    <main className="demo-cover">
      <p className="demo-cover__eyebrow">Versión de muestra</p>
      <h1>Glosario</h1>
      <p className="demo-cover__lead">Términos del negocio explicados en palabras simples: REF, tasa BCV, tasa operativa, precio en divisas, Pago móvil, Cashea, Crédito LC, compra para el trabajo, mano de obra, electroauto, regla del 85 % y tramos de recuperación.</p>
      <div className="demo-cover__actions"><Link className="btn btn-primary" href="/">Volver a la portada</Link><Link className="btn" href="/login/">Usar la muestra</Link></div>
    </main>
  );
}
