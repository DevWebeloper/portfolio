import CopyEmail from "@/components/CopyEmail";
import { PERSON } from "@/data/site";
import styles from "./Chrome.module.css";

export default function Chrome({ visible }: { visible: boolean }) {
  return (
    <div className={styles.chrome} data-visible={visible} inert={!visible}>
      <p className={styles.who}>
        <span className={styles.name}>{PERSON.name}</span>
        <span className={styles.role}>{PERSON.role}</span>
      </p>

      <p className={styles.status}>
        <span className={styles.dot} aria-hidden="true" />
        Available for remote roles
      </p>

      <nav className={styles.contact} aria-label="Contact">
        <CopyEmail email={PERSON.email} className={styles.link} />
        <a className={styles.link} href={PERSON.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className={styles.link} href={PERSON.cv} download>
          CV
        </a>
      </nav>
    </div>
  );
}
