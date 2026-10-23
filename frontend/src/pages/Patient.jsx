import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";

export default function Patient() {
  const [services, setServices] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function getServices() {
      try {
        const data = await apiRequest("services");
        setServices(data);
      } catch (err) {
        setError(err.message);
      }
    }

    getServices();
  }, []);

  return (
    <main>
      <h1>Dental Services</h1>

      {error && <p>{error}</p>}

      {services.map((service) => (
        <div key={service.id}>
          <h3>{service.name}</h3>
          <p>Duration: {service.duration_minutes} minutes</p>
          <p>Price: {service.price} JOD</p>
        </div>
      ))}
    </main>
  );
}