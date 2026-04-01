class BKTModel:
    def __init__(self, p_init=0.5, p_transit=0.1, p_slip=0.1, p_guess=0.2):
        self.p_learned = p_init
        self.p_transit = p_transit
        self.p_slip = p_slip
        self.p_guess = p_guess

    def update(self, correct: bool) -> float:
        if correct:
            p_obs = self.p_learned * (1 - self.p_slip) + (1 - self.p_learned) * self.p_guess
            p_learned_given_obs = (self.p_learned * (1 - self.p_slip)) / p_obs if p_obs > 0 else 0
        else:
            p_obs = self.p_learned * self.p_slip + (1 - self.p_learned) * (1 - self.p_guess)
            p_learned_given_obs = (self.p_learned * self.p_slip) / p_obs if p_obs > 0 else 0
            
        self.p_learned = p_learned_given_obs + (1 - p_learned_given_obs) * self.p_transit
        return self.p_learned
