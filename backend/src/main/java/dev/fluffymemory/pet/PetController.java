package dev.fluffymemory.pet;

import dev.fluffymemory.account.AccountService;
import dev.fluffymemory.care.CareService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pets")
public class PetController {
    private final AccountService accounts;
    private final PetService pets;
    private final CareService care;

    public PetController(AccountService accounts, PetService pets, CareService care) {
        this.accounts = accounts;
        this.pets = pets;
        this.care = care;
    }

    @GetMapping
    List<PetService.Pet> list(Principal user) {
        return pets.list(owner(user));
    }

    @GetMapping("/{id}")
    PetService.Pet get(@PathVariable long id, Principal user) {
        return pets.get(owner(user), id);
    }

    @PostMapping
    PetService.Pet create(@Valid @RequestBody PetService.Edit edit, Principal user) {
        return pets.create(owner(user), edit);
    }

    @PutMapping("/{id}")
    PetService.Pet update(@PathVariable long id, @Valid @RequestBody PetService.Edit edit, Principal user) {
        return pets.update(owner(user), id, edit);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id, Principal user) {
        pets.delete(owner(user), id);
    }

    @GetMapping("/{id}/care")
    List<CareService.Card> care(@PathVariable long id, Principal user) {
        return care.forPet(pets.get(owner(user), id));
    }

    private long owner(Principal user) {
        return accounts.require(user.getName()).id();
    }
}
