import type { Me } from '../types';

interface InitiationBannerProps {
  me: Me | undefined;
}

/** Shown until a referent validates the initiation: the API refuses any booking before. */
export const InitiationBanner = ({ me }: InitiationBannerProps) => {
  if (me?.initiationValidated !== false) return null;

  return (
    <p className="notice">
      Votre initiation n'est pas encore validée. Contactez un référent pour la faire : vous pourrez ensuite réserver.
    </p>
  );
};
