import { useEffect, useState } from 'react';

const api = async (url, opts) => {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};
const send = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});

function VehicleCard({ v, onBook }) {
  const [customer, setCustomer] = useState('');
  const [days, setDays] = useState(1);
  return (
    <div className="card">
      <b>{v.name}</b>{' '}
      <span className={`tag ${v.available ? '' : 'off'}`}>{v.available ? 'available' : 'rented'}</span>
      <p>{v.type} · Rs {v.price_per_day}/day</p>
      <input placeholder="Your name" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} />
      <button disabled={!v.available} onClick={() => onBook(v.id, customer, days)}>Book</button>
    </div>
  );
}

export default function App() {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [newV, setNewV] = useState({ name: '', type: 'car', price_per_day: '' });

  const load = async () => {
    try {
      setVehicles(await api('/api/vehicles'));
      setBookings(await api('/api/bookings'));
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setError('');
    try { await fn(); } catch (e) { setError(e.message); }
    load();
  };

  const book = (vehicle_id, customer, days) =>
    run(() => api('/api/bookings', send('POST', { vehicle_id, customer, days })));
  const giveBack = (id) => run(() => api(`/api/bookings/${id}/return`, send('POST')));
  const addVehicle = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/api/vehicles', send('POST', newV));
      setNewV({ name: '', type: 'car', price_per_day: '' });
    });
  };
  const nameOf = (id) => vehicles.find((v) => v.id === id)?.name || id;

  return (
    <div className="container">
      <h1>Vehicle Rental</h1>
      {error && <div className="error">{error}</div>}

      <h2>Vehicles</h2>
      <div className="grid">
        {vehicles.map((v) => <VehicleCard key={v.id} v={v} onBook={book} />)}
      </div>

      <h2>Add vehicle</h2>
      <form className="row" onSubmit={addVehicle}>
        <input placeholder="Name" value={newV.name} onChange={(e) => setNewV({ ...newV, name: e.target.value })} />
        <select value={newV.type} onChange={(e) => setNewV({ ...newV, type: e.target.value })}>
          <option>car</option><option>suv</option><option>bike</option><option>scooter</option>
        </select>
        <input type="number" placeholder="Price/day" value={newV.price_per_day}
          onChange={(e) => setNewV({ ...newV, price_per_day: e.target.value })} />
        <button type="submit">Add</button>
      </form>

      <h2>Bookings</h2>
      <table>
        <thead><tr><th>ID</th><th>Vehicle</th><th>Customer</th><th>Days</th><th>Total</th><th>Status</th><th /></tr></thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td><td>{nameOf(b.vehicle_id)}</td><td>{b.customer}</td>
              <td>{b.days}</td><td>{b.total_price}</td><td>{b.status}</td>
              <td>{b.status === 'active' && <button onClick={() => giveBack(b.id)}>Return</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
