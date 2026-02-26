from autonomy_core import AutonomyCore

class AutonomySDK:
    def __init__(self):
        self.core = AutonomyCore()
        
    def check_authorization(self, agent_id: str, action: dict) -> bool:
        """
        SDK method to check if an action is authorized through the AutonomyCore.
        """
        return self.core.authorize_action(agent_id, action)
