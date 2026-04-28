export function transportLink(
  type: string,
  origin: string,
  dest: string,
  dateFrom?: string
): string {
  const o = encodeURIComponent(origin);
  const d = encodeURIComponent(dest);
  const date = dateFrom ? `&date=${dateFrom}` : "";
  if (type === "plane")
    return `https://www.aviasales.ru/?origin_name=${o}&destination_name=${d}`;
  if (type === "train")
    return `https://www.tutu.ru/poezda/rasp_d.php?st1=${o}&st2=${d}${date}`;
  if (type === "bus") return `https://www.tutu.ru/buses/?st1=${o}&st2=${d}`;
  if (type === "car") return `https://yandex.ru/maps/?rtext=${o}~${d}`;
  return "#";
}

export function stayLink(destCity: string): string {
  return `https://ostrovok.ru/hotel/russia/?destination=${encodeURIComponent(destCity)}`;
}
