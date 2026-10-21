import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).parents[1] / 'publish-preproduction.py')
publisher = importlib.util.module_from_spec(spec); spec.loader.exec_module(publisher)


class PreproductionTests(unittest.TestCase):
    def test_exact_preproduction_artifact_and_target(self):
        env = dict(GITHUB_REF='refs/heads/dev', GITHUB_EVENT_NAME='push', VITE_TICKET_API_BASE_URL=publisher.ORIGIN,
                   RELEASE_SHA='a' * 40, GITHUB_RUN_ID='123')
        value = publisher.candidate(env, 'b' * 40, 'c' * 64)
        self.assertEqual(value['product'], 'plugin')
        self.assertEqual(value['apiOrigin'], publisher.ORIGIN)
        self.assertIsNone(value['baseArtifactSha256'])
        for changed in [dict(GITHUB_REF='refs/heads/main'), dict(GITHUB_EVENT_NAME='pull_request'),
                        dict(VITE_TICKET_API_BASE_URL='https://api-tickets.prestaya-latam.com'),
                        dict(RELEASE_SHA='latest'), dict(GITHUB_RUN_ID='')]:
            with self.assertRaises(ValueError): publisher.candidate({**env, **changed}, 'b' * 40, 'c' * 64)


if __name__ == '__main__':
    unittest.main()
