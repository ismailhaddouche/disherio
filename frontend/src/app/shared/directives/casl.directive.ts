import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { authStore } from '../../store/auth.store';
import { defineAbilityFor, type AppAbility } from '../../core/casl/ability.factory';

type AbilityCheck = Parameters<AppAbility['can']>;
type AbilityAction = AbilityCheck[0];
type AbilitySubject = AbilityCheck[1];

@Directive({ selector: '[caslCan]', standalone: true })
export class CaslCanDirective {
  action = input.required<AbilityAction>({ alias: 'caslCan' });
  subject = input.required<AbilitySubject>({ alias: 'caslCanSubject' });

  private tpl = inject<TemplateRef<unknown>>(TemplateRef);
  private vcr = inject(ViewContainerRef);

  constructor() {
    effect(() => {
      const user = authStore.user();
      const action = this.action();
      const subject = this.subject();
      this.vcr.clear();
      if (!user) return;
      const ability = defineAbilityFor(user);
      if (ability.can(action, subject)) {
        this.vcr.createEmbeddedView(this.tpl);
      }
    });
  }
}
