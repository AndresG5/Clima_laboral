/**
 * Tabla equivalente oculta visualmente, para que un lector de pantalla pueda leer una gráfica
 * como datos. La clase sr-only va en un <div> envolvente, no en la <table>: con
 * table-layout auto, una tabla ignora un width de 1px cuando su contenido es más ancho, así
 * que sr-only aplicado directamente a la tabla no la encoge y termina desbordando la página.
 */
export function VisuallyHiddenTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>{columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
