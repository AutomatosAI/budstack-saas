export function generateMockSignupData() {
  const data = [];
  const today = new Date();

  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const count = Math.floor(Math.random() * 5) + 1;

    data.push({
      date: date.toISOString().split("T")[0],
      count,
    });
  }

  return data;
}

export function generateMockRevenueData() {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const data = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(2);
    const revenue = Math.floor(Math.random() * 50000) + 80000;

    data.push({
      month: `${monthName} '${year}`,
      revenue,
    });
  }

  return data;
}
