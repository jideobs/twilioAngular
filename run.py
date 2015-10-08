__author__ = 'jideobs ( jideobs@gmail.com )'
__version__ = 'AlertClinic Beta Version 0.0.1.1'

import webapp2
import os
import sys
import jinja2

CURRENT_DIR = os.path.dirname(__file__)
LIB_DIR = '%s/venv/lib/python2.7/site-packages/' % CURRENT_DIR

if LIB_DIR not in sys.path:
    sys.path.append(LIB_DIR)

from twilio.util import TwilioCapability
import twilio.twiml
from twilio.rest import TwilioRestClient

class Index(webapp2.RequestHandler):
    def get(self):
        capability = TwilioCapability(self.app.config.get('account_sid'), self.app.config.get('auth_token'))
        capability.allow_client_outgoing(self.app.config.get('application_sid'))
        capability.allow_client_incoming('agent1')
        token = capability.generate()
        params = {'token': token}
        jinja_env = self.app.config.get('template')
        template_environment = jinja_env('views').get_template('index.html')
        self.response.write(template_environment.render(params))


class CallCenter(webapp2.RequestHandler):

    def _get_free_agent(self):
        response = twilio.twiml.Response()
        free_agent_username = 'agent1'
        with response.dial(callerId=self.request.get('From'), record=True) as r:
            r.client(free_agent_username)
        return response

    def voice(self):
        """
        :return: None
        :desc: Incoming calls handler
        """
        response = twilio.twiml.Response()
        phone_number = self.request.get('PhoneNumber')
        call_status = self.request.get('CallStatus')
        if call_status and call_status == 'completed':
            response.say('Thanks for calling e-alert. Goodbye!', voice='woman')
            response.hangup()
        else:
            if phone_number:
                try:
                    int(phone_number)
                except ValueError:
                    with response.dial(callerId=self.request.get('From'), record=True) as r:
                        r.client(phone_number)
                else:
                    response.dial('+%s' % phone_number,
                                  callerId=self.app.config.get('caller_id'),
                                  record=True)
            else:
                response = self._get_free_agent()
            self.response.content_type = 'application/xml'
            self.response.write(str(response))

    def wait_handler(self):
        """
        :return: None
        :desc: Handle caller waiting
        """
        response = twilio.twiml.Response()
        response.say("You are number %s in the queue. Please hold" % self.request.get('QueuePosition'),
                     voice="woman")
        response.play("http://www.leadinghealth.ng/audio.mp3")
        self.response.write(str(response))

    def queue_handler(self):
        """
        :return: None
        :desc: Handle call queues
        """
        response = twilio.twiml.Response()
        with response.dial() as dial:
            response.say('Thanks for holding. You are now being connected to an agent!', voice='woman')
            dial.queue("Call Queue")
        self.response.content_type = 'application/xml'
        self.response.write(str(response))

    def transfer_call(self, client_to):
        incoming_call_sid = self.request.json.get('callSid')
        if incoming_call_sid:
            client = TwilioRestClient(account=self.app.config.get('account_sid'),
                                      token=self.app.config.get('auth_token'))
            to_client_url = 'http://7c8fe249.ngrok.com/call?PhoneNumber=%s' % client_to
            client.calls.update(incoming_call_sid, method="POST", url=to_client_url)
            return 'success', {'message': 'Call successfully transferred!'}
        else:
            self.response.status = 400
            return 'error', {'message': 'No call!!!'}

CURRENT_DIR = os.path.dirname(__file__)
VIEWS_DIR = {'views': '%s/app' % CURRENT_DIR}


def jinja_env(view_dir):
    return jinja2.Environment(loader=jinja2.FileSystemLoader(VIEWS_DIR[view_dir]),
                              extensions=['jinja2.ext.autoescape'],
                              autoescape=True)

configurations = {
    'template': jinja_env,
    'account_sid': 'AC361cd25b4e7a5e1295addf2ad95b600f',
    'auth_token': 'cf97e66479609e729ac620baf99aa24e',
    'application_sid': 'APa1fa23e460fb40fcab0d3929477413ef',
    'caller_id': '+18653660355',
    'busy_text': 'Please hold on for the next agent, as all our agents are busy.Thank you!',
    'no_agents': 'Please note that our customer service is not available right now!',
    'CALL_QUEUE_NO': '+18779596773',
    'OUTGOING_CALLER_ID': '18653660355',
}

routes = [{'endpoint': '/', 'handler': Index, 'name': 'Index', 'methods': ['GET']},
{'endpoint': '/call-center/voice', 'handler': CallCenter, 'name': 'voice incoming',
 'methods': ['GET', 'POST'], 'handler_method': 'voice'},
{'endpoint': '/call-center/transfer-call', 'handler': CallCenter, 'name': 'call transfer',
 'methods': ['POST'], 'handler_method': 'transfer_call'},
{'endpoint': '/call-center/queue', 'handler': CallCenter, 'name': 'call queue', 'methods': ['POST'],
 'handler_method': 'queue_handler'},
{'endpoint': '/call-center/wait', 'handler': CallCenter, 'name': 'call wait', 'methods': ['POST'],
 'handler_method': 'wait_handler'}]

def build_route(route):
    endpoint = route.get('endpoint', None)
    handler = route.get('handler', None)
    name = route.get('name', None)
    handler_method = route.get('handler_method', None)
    methods = route.get('methods', [])

    return webapp2.Route(endpoint, handler, name, handler_method=handler_method, methods=methods)


application = webapp2.WSGIApplication(map(build_route, routes), debug=True, config=configurations)


def main():
    application.run()


if __name__ == '__main__':
    main()
