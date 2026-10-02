import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="app-content flex items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Ups! Siden blev ikke fundet</p>
        <Link to="/" className="text-primary underline focus-visible:ring-2 focus-visible:ring-ring">
          Tilbage til forsiden
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
