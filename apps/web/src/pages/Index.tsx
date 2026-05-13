import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar, Users, Clock, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-1000">
            picshift
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-150">
            Modern shift scheduling made simple. Pick up shifts, manage your team, all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 shadow-medium hover:shadow-lg transition-all"
              onClick={() => navigate("/auth")}
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-6 transition-all"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-24">
            <div className="p-6 rounded-xl bg-gradient-card shadow-soft hover:shadow-medium transition-all animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Easy Scheduling</h3>
              <p className="text-muted-foreground">
                View available shifts on an intuitive calendar and claim them instantly
              </p>
            </div>

            <div className="p-6 rounded-xl bg-gradient-card shadow-soft hover:shadow-medium transition-all animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Team Management</h3>
              <p className="text-muted-foreground">
                Managers can create and track shifts across your entire workforce
              </p>
            </div>

            <div className="p-6 rounded-xl bg-gradient-card shadow-soft hover:shadow-medium transition-all animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-900">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-time Updates</h3>
              <p className="text-muted-foreground">
                See shifts update live as they're claimed or released by team members
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
